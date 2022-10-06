import Component from '../index';
import { PluginInterface } from './PluginInterface';

export default class implements PluginInterface {
    private isWindowUnloaded = false;
    private isListening = false;

    constructor() {
        this.markAsWindowUnloaded = this.markAsWindowUnloaded.bind(this);
    }

    attachToComponent(component: Component): void {
        component.on('render:started', (html: string, response: Response, controls: { shouldRender: boolean }) => {
            if (this.isWindowUnloaded) {
                controls.shouldRender = false;
            }
        });

        component.on('connect', () => {
            this.attachListener();
        });

        component.on('disconnect', () => {
            this.detachListener();
        });
    }

    markAsWindowUnloaded(): void {
        this.isWindowUnloaded = true;
    }

    private attachListener(): void {
        if (this.isListening) {
            return;
        }

        window.addEventListener('beforeunload', this.markAsWindowUnloaded);
        this.isListening = true;
    }

    private detachListener(): void {
        window.removeEventListener('beforeunload', this.markAsWindowUnloaded);
        this.isListening = false;
    }
}
