import { registerReactControllerComponents } from '@symfony/ux-react';
import {registerVueControllerComponents} from "@symfony/ux-vue";
import { registerSvelteControllerComponents } from "@symfony/ux-svelte";
import 'bootstrap/dist/css/bootstrap.min.css';

// start the Stimulus application
import './bootstrap.js';

// imported to initialize global plugins
// dropdown, collapse, tab
import * as bootstrap from 'bootstrap';

registerReactControllerComponents();
registerVueControllerComponents();
registerSvelteControllerComponents();
