// should result in a link tag, as app.js -> this file -> my_custom_module.js
import './styles/red_background.css';
// should be modulepreload for same reason
import './imported_cool_file.js';
console.log('my_custom_module.js');
