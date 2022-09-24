import { Controller } from '@hotwired/stimulus';
import { parseDirectives, DirectiveModifier } from './directives_parser';
import { normalizeModelName } from './string_utils';
import {
    getModelDirectiveFromElement,
    getElementAsTagText,
    setValueOnElement,
    getValueFromElement,
    elementBelongsToThisController,
} from './dom_utils';
import Component from "./Component";
import Backend from "./Backend";
import ModelSynchronizer from "./ModelSynchronizer";
import {DataModelElementResolver} from "./ModelElementResolver";

interface UpdateModelOptions {
    dispatch?: boolean;
    debounce?: number|boolean;
}

export interface LiveController {
    dataValue: any;
    element: Element,
    childComponentControllers: Array<LiveController>
}

export default class extends Controller implements LiveController {
    static values = {
        url: String,
        data: Object,
        csrf: String,
        /**
         * The Debounce timeout.
         *
         * Default: 150
         */
        debounce: { type: Number, default: 150 },
    }

    readonly urlValue!: string;
    dataValue!: any;
    readonly csrfValue!: string;
    readonly hasDebounceValue: boolean;
    readonly debounceValue: number;

    component: Component;
    private readonly modelSynchronizer: ModelSynchronizer;

    /**
     * Current "timeout" before the pending request should be sent.
     */
    requestDebounceTimeout: number | null = null;

    isWindowUnloaded = false;

    mutationObserver: MutationObserver|null = null;

    childComponentControllers: Array<LiveController> = [];

    pendingActionTriggerModelElement: HTMLElement|null = null;

    private elementEventListeners: Array<{ event: string, callback: (event: any) => void }> = [
         { event: 'input', callback: (event) => this.handleInputEvent(event) },
         { event: 'change', callback: (event) => this.handleChangeEvent(event) },
     ];

    initialize() {
        // TODO / fix/replace all of this
        this.markAsWindowUnloaded = this.markAsWindowUnloaded.bind(this);
        this.handleUpdateModelEvent = this.handleUpdateModelEvent.bind(this);
        this.handleConnectedControllerEvent = this.handleConnectedControllerEvent.bind(this);
        this.handleDisconnectedControllerEvent = this.handleDisconnectedControllerEvent.bind(this);

        if (!(this.element instanceof HTMLElement)) {
            throw new Error('Invalid Element Type');
        }

        this.component = new Component(
            this.element,
            this.dataValue,
            new Backend(this.urlValue, this.csrfValue),
            new DataModelElementResolver(),
        );
        if (this.hasDebounceValue) {
            this.component.defaultDebounce = this.debounceValue;
        }

        // TODO put back most of the input/change listener and the "updateModelFromElement" stuff
        this.synchronizeValueOfModelFields();
    }

    connect() {
        this.component.connect();
        this.initializePolling();

        this.elementEventListeners.forEach(({event, callback}) => {
            this.component.element.addEventListener(event, callback);
        });

        // hide "loading" elements to begin with
        // This is done with CSS, but only for the most basic cases

        // helps typescript be sure this is an HTMLElement, not just Element
        if (!(this.element instanceof HTMLElement)) {
            throw new Error('Invalid Element Type');
        }

        window.addEventListener('beforeunload', this.markAsWindowUnloaded);
        this._startAttributesMutationObserver();
        this.element.addEventListener('live:update-model', this.handleUpdateModelEvent);

        this.element.addEventListener('live:connect', this.handleConnectedControllerEvent);

        this._dispatchEvent('live:connect', { controller: this });
    }

    disconnect() {
        this.component.disconnect();
        this.#clearRequestDebounceTimeout();

        this.elementEventListeners.forEach(({event, callback}) => {
            this.component.element.removeEventListener(event, callback);
        });

        window.removeEventListener('beforeunload', this.markAsWindowUnloaded);
        this.element.removeEventListener('live:update-model', this.handleUpdateModelEvent);
        this.element.removeEventListener('live:connect', this.handleConnectedControllerEvent);
        this.element.removeEventListener('live:disconnect', this.handleDisconnectedControllerEvent);

        this._dispatchEvent('live:disconnect', { controller: this });

        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
    }

    /**
     * Called to update one piece of the model.
     *
     *      <button data-action="live#update" data-model="foo" data-value="5">
     */
    update(event: any) {
        if (event.type === 'input' || event.type === 'change') {
            throw new Error(`Since LiveComponents 2.3, you no longer need data-action="live#update" on form elements. Found on element: ${getElementAsTagText(event.target)}`);
        }

        this.updateModelFromElementEvent(event.target, null);
    }

    action(event: any) {
        // using currentTarget means that the data-action and data-action-name
        // must live on the same element: you can't add
        // data-action="click->live#action" on a parent element and
        // expect it to use the data-action-name from the child element
        // that actually received the click
        const rawAction = event.currentTarget.dataset.actionName;

        // data-action-name="prevent|debounce(1000)|save"
        const directives = parseDirectives (rawAction);
        let debounce: number|boolean = false;

        directives.forEach((directive) => {
            const validModifiers: Map<string, (modifier: DirectiveModifier) => void> = new Map();
            validModifiers.set('prevent', () => {
                event.preventDefault();
            });
            validModifiers.set('stop', () => {
                    event.stopPropagation();
            });
            validModifiers.set('self', () => {
                if (event.target !== event.currentTarget) {
                    return;
                }
            });
            validModifiers.set('debounce', (modifier: DirectiveModifier) => {
                debounce = modifier.value ? parseInt(modifier.value) : true;
            });

            directive.modifiers.forEach((modifier) => {
                if (validModifiers.has(modifier.name)) {
                    // variable is entirely to make ts happy
                    const callable = validModifiers.get(modifier.name) ?? (() => {});
                    callable(modifier);

                    return;
                }

                console.warn(`Unknown modifier ${modifier.name} in action "${rawAction}". Available modifiers are: ${Array.from(validModifiers.keys()).join(', ')}.`);
            });

            this.component.action(directive.action, directive.named, debounce);

            // TODO: fix this
            // possible case where this element is also a "model" element
            // if so, to be safe, slightly delay the action so that the
            // change/input listener on LiveController can process the
            // model change *before* sending the action
            if (getModelDirectiveFromElement(event.currentTarget, false)) {
                this.pendingActionTriggerModelElement = event.currentTarget;
                this.#clearRequestDebounceTimeout();
            }
        })
    }

    $render() {
        this.component.render();
    }

    /**
     * Update a model value.
     *
     * The extraModelName should be set to the "name" attribute of an element
     * if it has one. This is only important in a parent/child component,
     * where, in the child, you might be updating a "foo" model, but you
     * also want this update to "sync" to the parent component's "bar" model.
     * Typically, setup on a field like this:
     *
     *      <input data-model="foo" name="bar">
     *
     * @param {string} model The model to update
     * @param {any} value The new value
     * @param {boolean} shouldRender Whether a re-render should be triggered
     * @param {string|null} extraModelName Another model name that this might go by in a parent component.
     * @param {UpdateModelOptions} options
     */
    $updateModel(model: string, value: any, shouldRender = true, extraModelName: string|null = null, options: UpdateModelOptions = {}) {
        const modelName = normalizeModelName(model);
        const normalizedExtraModelName = extraModelName ? normalizeModelName(extraModelName) : null;

        // TODO: support this again
        if (options.dispatch !== false) {
            this._dispatchEvent('live:update-model', {
                modelName,
                extraModelName: normalizedExtraModelName,
                value
            });
        }

        this.component.set(model, value, shouldRender, options.debounce);
    }

    private handleInputEvent(event: Event) {
        const target = event.target as Element;
        if (!target) {
            return;
        }

        this.updateModelFromElementEvent(target, 'input')
    }

    private handleChangeEvent(event: Event) {
        const target = event.target as Element;
        if (!target) {
            return;
        }

        this.updateModelFromElementEvent(target, 'change')
    }

    /**
     * Sets a model given an element and some event.
     *
     * This parses the "data-model" from the element and takes
     * into account modifiers like "debounce", "norender" and "on()".
     *
     * This is used, for example, the grab the new value from an input
     * on "change" and set that new value onto the model.
     *
     * It's also used to, on click, set the value from a button
     * with data-model="" and data-value"".
     *
     * @param element
     * @param eventName If specified (e.g. "input" or "change"), the model may
     *                  skip updating if the on() modifier is passed (e.g. on(change)).
     *                  If not passed, the model will always be updated.
     */
    private updateModelFromElementEvent(element: Element, eventName: string|null) {
        if (!elementBelongsToThisController(element, this)) {
            return;
        }

        if (!(element instanceof HTMLElement)) {
            throw new Error('Could not update model for non HTMLElement');
        }

        const modelDirective = getModelDirectiveFromElement(element, false);

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
        if (this.pendingActionTriggerModelElement === element) {
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

    markAsWindowUnloaded = () => {
        this.isWindowUnloaded = true;
    };

    handleConnectedControllerEvent(event: any) {
        if (event.target === this.element) {
            return;
        }

        this.childComponentControllers.push(event.detail.controller);
        // live:disconnect needs to be registered on the child element directly
        // that's because if the child component is removed from the DOM, then
        // the parent controller is no longer an ancestor, so the live:disconnect
        // event would not bubble up to it.
        event.detail.controller.element.addEventListener('live:disconnect', this.handleDisconnectedControllerEvent);
    }

    handleDisconnectedControllerEvent(event: any) {
        if (event.target === this.element) {
            return;
        }

        const index = this.childComponentControllers.indexOf(event.detail.controller);

        // Remove value from an array
        if (index > -1) {
            this.childComponentControllers.splice(index, 1);
        }
    }

    handleUpdateModelEvent(event: any) {
        // ignore events that we dispatched
        if (event.target === this.element) {
            return;
        }

        this._handleChildComponentUpdateModel(event);
    }

    _handleChildComponentUpdateModel(event: any) {
        const mainModelName = event.detail.modelName;
        const potentialModelNames = [
            { name: mainModelName, required: false },
        ];
        if (event.detail.extraModelName) {
            potentialModelNames.push({ name: event.detail.extraModelName, required: false });
        }

        const modelMapElement = event.target.closest('[data-model-map]');
        if (this.element.contains(modelMapElement)) {
            const directives = parseDirectives(modelMapElement.dataset.modelMap);

            directives.forEach((directive) => {
                let from = null;
                directive.modifiers.forEach((modifier) => {
                    switch (modifier.name) {
                        case 'from':
                            if (!modifier.value) {
                                throw new Error(`The from() modifier requires a model name in data-model-map="${modelMapElement.dataset.modelMap}"`);
                            }
                            from = modifier.value;

                            break;
                        default:
                            console.warn(`Unknown modifier "${modifier.name}" in data-model-map="${modelMapElement.dataset.modelMap}".`);
                    }
                });

                if (!from) {
                    throw new Error(`Missing from() modifier in data-model-map="${modelMapElement.dataset.modelMap}". The format should be "from(childModelName)|parentModelName"`);
                }

                // only look maps for the model currently being updated
                if (from !== mainModelName) {
                    return;
                }

                potentialModelNames.push({ name: directive.action, required: true });
            });
        }

        potentialModelNames.reverse();
        let foundModelName: string | null = null;
        potentialModelNames.forEach((potentialModel) => {
            if (foundModelName) {
                return;
            }

            if (this.component.valueStore.hasAtTopLevel(potentialModel.name)) {
                foundModelName = potentialModel.name;

                return;
            }

            if (potentialModel.required) {
                throw new Error(`The model name "${potentialModel.name}" does not exist! Found in data-model-map="from(${mainModelName})|${potentialModel.name}"`);
            }
        });

        if (!foundModelName) {
            return;
        }

        this.$updateModel(
            foundModelName,
            event.detail.value,
            false,
            null,
            {
                dispatch: false
            }
        );
    }

    /**
     * Helps "re-normalize" certain root element attributes after a re-render.
     *
     *      1) Re-establishes the data-original-data attribute if missing.
     *      2) Stops or re-initializes data-poll
     *
     * This happens if a parent component re-renders a child component
     * and morphdom *updates* child. This commonly happens if a parent
     * component is around a list of child components, and changing
     * something in the parent causes the list to change. In that case,
     * the child component might be removed while another is added.
     * But to morphdom, this sometimes looks like an "update". The result
     * is that the child component is re-rendered, but the child component
     * is not re-initialized. And so, the data-original-data attribute
     * is missing and never re-established.
     */
    _startAttributesMutationObserver() {
        if (!(this.element instanceof HTMLElement)) {
            throw new Error('Invalid Element Type');
        }
        const element : HTMLElement = this.element;

        this.mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // TODO: fix this
                return;
                /*
                if (mutation.type === 'attributes') {
                    if (!element.dataset.originalData) {
                        this.originalDataJSON = this.valueStore.asJson();
                        this._exposeOriginalData();
                    }

                    this._initiatePolling();
                }
                 */
            });
        });

        this.mutationObserver.observe(this.element, {
            attributes: true
        });
    }

    #clearRequestDebounceTimeout() {
        // clear any pending renders
        if (this.requestDebounceTimeout) {
            clearTimeout(this.requestDebounceTimeout);
            this.requestDebounceTimeout = null;
        }
    }

    _dispatchEvent(name: string, payload: any = null, canBubble = true, cancelable = false) {
        return this.element.dispatchEvent(new CustomEvent(name, {
            bubbles: canBubble,
            cancelable,
            detail: payload
        }));
    }

    private initializePolling(): void {
        if ((this.element as HTMLElement).dataset.poll === undefined) {
            return;
        }

        const rawPollConfig = (this.element as HTMLElement).dataset.poll;
        const directives = parseDirectives(rawPollConfig || '$render');

        directives.forEach((directive) => {
            let duration = 2000;

            directive.modifiers.forEach((modifier) => {
                switch (modifier.name) {
                    case 'delay':
                        if (modifier.value) {
                            duration = parseInt(modifier.value);
                        }

                         break;
                    default:
                        console.warn(`Unknown modifier "${modifier.name}" in data-poll "${rawPollConfig}".`);
                }
            });

            this.component.startPoll(directive.action, duration);
        })
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
    // TODO: call this when needed
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
            if (this.component.getUnsyncedModels().includes(modelName)) {
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
}
