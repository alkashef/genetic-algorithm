/**
 * @module main
 * @description Application entry point — wiring only, no logic. Initializes
 * each view module; citySetupView goes last because its init seeds the
 * first random city set and the other views must already be listening.
 */

import { initTabs } from "./tabs.js";
import { initBruteForceView } from "./bruteForceView.js";
import { initGaView } from "./gaView.js";
import { initCitySetupView } from "./citySetupView.js";

initTabs();
initBruteForceView();
initGaView();
initCitySetupView();
