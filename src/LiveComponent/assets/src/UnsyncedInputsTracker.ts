import UnsyncedInputContainer from "./UnsyncedInputContainer";
import {ModelElementResolver} from "./ModelElementResolver";
import {elementBelongsToThisController} from "./dom_utils";

export default class {
    private readonly element: HTMLElement;
    private readonly modelElementResolver: ModelElementResolver;
    /** Fields that have changed, but whose value is not set back onto the value store */
    private readonly unsyncedInputs: UnsyncedInputContainer;

    private elementEventListeners: Array<{ event: string, callback: (event: any) => void }> = [
        { event: 'input', callback: (event) => this.handleInputEvent(event) },
    ];

    constructor(element: HTMLElement, modelElementResolver: ModelElementResolver) {
        this.element = element;
        this.modelElementResolver = modelElementResolver;
        this.unsyncedInputs = new UnsyncedInputContainer();
    }

    activate(): void {
        this.elementEventListeners.forEach(({event, callback}) => {
            this.element.addEventListener(event, callback);
        });
    }

    deactivate(): void {
        this.elementEventListeners.forEach(({event, callback}) => {
            this.element.removeEventListener(event, callback);
        });
    }

    markModelAsSynced(modelName: string): void {
        this.unsyncedInputs.markModelAsSynced(modelName);
    }

    private handleInputEvent(event: Event) {
        const target = event.target as Element;
        if (!target) {
            return;
        }

        this.updateModelFromElement(target)
    }

    private updateModelFromElement(element: Element) {
        // TODO: put back this child element check
        if (!elementBelongsToThisController(element, this)) {
            return;
        }

        if (!(element instanceof HTMLElement)) {
            throw new Error('Could not update model for non HTMLElement');
        }

        const modelName = this.modelElementResolver.getModelName(element);
        // track any inputs that are "unsynced"
        this.unsyncedInputs.add(element, modelName);
    }

    getUnsyncedInputs(): HTMLElement[] {
        return this.unsyncedInputs.all();
    }

    getModifiedModels(): string[] {
        return Array.from(this.unsyncedInputs.getModifiedModels());
    }
}
