/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { FluxDispatcher } from "@webpack/common";

let suspended = false;
let locked = false;

export default definePlugin({
    name: "NativeIdle",
    description:
        "Provides native idle integration for Vesktop, mimicking the official Discord desktop client's auto-idling behaviours",
    tags: ["Activity", "Utility"],
    authors: [Devs.Timbits],
    enabledByDefault: IS_VESKTOP && VesktopNative.powerMonitor,
    patches: [
        {
            find: "IdleStore",
            predicate: () => IS_VESKTOP && VesktopNative.powerMonitor,
            replacement: [
                {
                    match: /\i\.isPlatformEmbedded&&/,
                    /* NOTE: I know using mangled names is dumb and bad practice, but it's a compromise over
                     * patching/replacing N()'s name (sets idle or afk) and the global i variable (timestamp
                     * for power event triggered idling).
                     * y looks like function y(e){e&&(i=Date.now()),N()} */
                    replace: "($self.powerMonitorHooks(y), true) ||",
                },
                {
                    match: /\i\.\i\.powerMonitor\.on\("(?:suspend|resume|lock-screen|unlock-screen)",\(\)=>\{.*?\}\)/g,
                    replace: "null",
                },
                {
                    match: /(?<=return )\i\|\|\i/,
                    replace: "$self.suspended() || $self.locked()",
                },
                {
                    match: /(?<=getSystemSuspended\(\)\{return )\i(}getSystemLocked\(\)\{return )\i/,
                    replace: "$self.suspended()$1$self.locked()",
                },
            ],
        },
    ],
    powerMonitorHooks(handleEvent: (setIdle: boolean) => void) {
        VesktopNative.powerMonitor.on("suspend", () => {
            handleEvent((suspended = true));

            /* NOTE: This tries to replicate l.default.disconnect(). It's missing the remote disconnect logic,
             * but I think "remote" is referencing vc console/playstation integration so nothing critical */
            FluxDispatcher.dispatch({
                type: "VOICE_CHANNEL_SELECT",
                channelId: null,
            });
            FluxDispatcher.dispatch({
                type: "POPOUT_WINDOW_CLOSE",
                key: "DISCORD_CHANNEL_CALL_POPOUT",
            });
        });
        VesktopNative.powerMonitor.on("resume", () =>
            handleEvent((suspended = false)),
        );
        VesktopNative.powerMonitor.on("lock-screen", () =>
            handleEvent((locked = true)),
        );
        VesktopNative.powerMonitor.on("unlock-screen", () =>
            handleEvent((locked = false)),
        );
    },
    suspended: () => suspended,
    locked: () => locked,
});
