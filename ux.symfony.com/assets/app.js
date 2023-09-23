import './styles/app.scss';
import './styles/green_h1.css';

// app is an entrypoint, but the "preload" will not cascade onto this because
// it is a lazy import. If you change to `import 'my_custom_module';` it will
// be promoted to preload, along with the JS file it imports and the CSS file
// (which will become a link tag).
setTimeout(() => {
    // after 2 seconds, this is loaded, which also adds an imported other.css
    // (that makes the background red)
    import('my_custom_module');
}, 2000);

import { registerReactControllerComponents } from '@symfony/ux-react';
import {registerVueControllerComponents} from "@symfony/ux-vue";
import { registerSvelteControllerComponents } from "@symfony/ux-svelte";

// start the Stimulus application
import './bootstrap.js';

// imported to initialize global plugins
// dropdown, collapse, tab
import * as bootstrap from 'bootstrap';

registerReactControllerComponents();
registerVueControllerComponents();
registerSvelteControllerComponents();
