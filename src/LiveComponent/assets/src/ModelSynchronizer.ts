import {
    getModelDirectiveFromElement,
    getValueFromElement,
    setValueOnElement
} from "./dom_utils";
import UnsyncedInputContainer from "./UnsyncedInputContainer";
import Component from "./Component";

export default class {
    private readonly component: Component;
    /** Fields that have changed, but whose value is not set back onto the value store */
    private readonly unsyncedInputs: UnsyncedInputContainer;

    private elementEventListeners: Array<{ event: string, callback: (event: any) => void }> = [
        { event: 'input', callback: (event) => this.handleInputEvent(event) },
        { event: 'change', callback: (event) => this.handleChangeEvent(event) },
    ];

    constructor(component: Component) {
        this.component = component;
        this.unsyncedInputs = new UnsyncedInputContainer();
    }

    activate(): void {
        this.elementEventListeners.forEach(({event, callback}) => {
            this.component.element.addEventListener(event, callback);
        });
    }

    deactivate(): void {
        this.elementEventListeners.forEach(({event, callback}) => {
            this.component.element.removeEventListener(event, callback);
        });
    }

    /**
     * Sets the "value" of all model fields to the component data.
     *
     * This is called when the component initializes and after re-render.
     * Take the following element:
     *
     *      <input data-model="firstName">
     *
     * This method will set the "value" of that element to the value of
     * the "firstName" model.
     */
    synchronizeValueOfModelFields(): void {
        this.component.element.querySelectorAll('[data-model]').forEach((element: Element) => {
            if (!(element instanceof HTMLElement)) {
                throw new Error('Invalid element using data-model.');
            }

            if (element instanceof HTMLFormElement) {
                return;
            }

            const modelDirective = getModelDirectiveFromElement(element);
            if (!modelDirective) {
                return;
            }

            const modelName = modelDirective.action;

            // skip any elements whose model name is currently in an unsynced state
            if (this.unsyncedInputs.getModifiedModels().includes(modelName)) {
                return;
            }

            if (this.component.valueStore.has(modelName)) {
                setValueOnElement(element, this.component.valueStore.get(modelName))
            }

            // for select elements without a blank value, one might be selected automatically
            // https://github.com/symfony/ux/issues/469
            if (element instanceof HTMLSelectElement && !element.multiple) {
                this.component.valueStore.set(modelName, getValueFromElement(element, this.component.valueStore));
            }
        })
    }

    markModelAsSynced(modelName: string): void {
        this.unsyncedInputs.markModelAsSynced(modelName);
    }

    updateFromElement(element: HTMLElement) {
        this.updateModelFromElement(element, null);
    }

    private handleInputEvent(event: Event) {
        const target = event.target as Element;
        if (!target) {
            return;
        }

        this.updateModelFromElement(target, 'input')
    }

    private handleChangeEvent(event: Event) {
        const target = event.target as Element;
        if (!target) {
            return;
        }

        this.updateModelFromElement(target, 'change')
    }

    /**
     * @param element
     * @param eventName If specified (e.g. "input" or "change"), the model may
     *                  skip updating if the on() modifier is passed (e.g. on(change)).
     *                  If not passed, the model will always be updated.
     */
    private updateModelFromElement(element: Element, eventName: string|null) {
        // TODO: put back this child element check
        if (eventName == 'bar') {
        //if (!elementBelongsToThisController(element, this)) {
            return;
        }

        if (!(element instanceof HTMLElement)) {
            throw new Error('Could not update model for non HTMLElement');
        }

        const modelDirective = getModelDirectiveFromElement(element, false);
        if (eventName === 'input') {
            const modelName = modelDirective ? modelDirective.action : null;
            // track any inputs that are "unsynced"
            this.unsyncedInputs.add(element, modelName);
        }

        // if not tied to a model, no more work to be done
        if (!modelDirective) {
            return;
        }

        let shouldRender = true;
        let targetEventName = 'input';
        let debounce: number|boolean = false;

        modelDirective.modifiers.forEach((modifier) => {
            switch (modifier.name) {
                case 'on':
                    if (!modifier.value) {
                        throw new Error(`The "on" modifier in ${modelDirective.getString()} requires a value - e.g. on(change).`);
                    }
                    if (!['input', 'change'].includes(modifier.value)) {
                        throw new Error(`The "on" modifier in ${modelDirective.getString()} only accepts the arguments "input" or "change".`);
                    }

                    targetEventName = modifier.value;

                    break;
                case 'norender':
                    shouldRender = false;

                    break;

                case 'debounce':
                    debounce = modifier.value ? parseInt(modifier.value) : true;

                    break;
                default:
                    console.warn(`Unknown modifier "${modifier.name}" in data-model="${modelDirective.getString()}".`);
            }
        });

        // rare case where the same event+element triggers a model
        // update *and* an action. The action is already scheduled
        // to occur, so we do not need to *also* trigger a re-render.
        // TODO: fix this
        if (targetEventName == 'barrr') {
        //if (this.pendingActionTriggerModelElement === element) {
            shouldRender = false;
        }

        // e.g. we are targeting "change" and this is the "input" event
        // so do *not* update the model yet
        if (eventName && targetEventName !== eventName) {
            return;
        }

        if (false === debounce) {
            if (targetEventName === 'input') {
                // true debounce will cause default to be used
                debounce = true;
            } else {
                // for change, add no debounce
                debounce = 0;
            }
        }

        const finalValue = getValueFromElement(element, this.component.valueStore);

        this.component.set(modelDirective.action, finalValue, shouldRender, debounce);
    }

    getUnsyncedInputs(): HTMLElement[] {
        return this.unsyncedInputs.all();
    }
}
