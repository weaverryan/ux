import BackendRequest from './BackendRequest';
import { Directive } from './directives_parser';
import {
    addAttributes,
    addClass, removeAttributes,
    removeClass,
    setDisplayStyle
} from "./dom_utils";

export interface DelayedDetails {
    delay: number,
    isStillLoading: () => boolean,
}

export class LoadingInstructions {
    element: HTMLElement|SVGElement;
    shouldShowElement: boolean;
    shouldHideElement: boolean;
    visibilityDelay: null|DelayedDetails;
    classesToAdd: Array<{ name: string, delayDetails: DelayedDetails }>;
    classesToRemove: Array<{ name: string, delayDetails: DelayedDetails }>;
    attributesToAdd: Array<{ name: string, delayDetails: DelayedDetails }>;
    attributesToRemove: Array<{ name: string, delayDetails: DelayedDetails }>;

    execute(): void {
        // TODO handle delays
        if (this.shouldShowElement) {
            setDisplayStyle(this.element, 'none');
        } else if (this.shouldHideElement) {
            // TODO: support other types of "displays"
            setDisplayStyle(this.element, 'inline-block');
        }

        this.classesToAdd.forEach(({ name, delayDetails }) => {
            addClass(this.element, [name]);
        })
        this.classesToRemove.forEach(({ name, delayDetails }) => {
            removeClass(this.element, [name]);
        })
        this.attributesToAdd.forEach(({ name, delayDetails }) => {
            addAttributes(this.element, [name]);
        })
        this.attributesToRemove.forEach(({ name, delayDetails }) => {
            removeAttributes(this.element, [name]);
        })
    }
}
interface IndividualChangeDetails {
    action: string,
    delayDetails: DelayedDetails
}

class LoadingCalculatorHelper {
    #element: HTMLElement|SVGElement;
    #visibility: IndividualChangeDetails|null = null;
    #classes: Map<string, IndividualChangeDetails>;
    #attributes: Map<string, IndividualChangeDetails>;

    constructor(element: HTMLElement|SVGElement) {
        this.#element = element;
    }

    showElement(delayDetails: DelayedDetails): void {
        this.#visibility = { action: 'show', delayDetails }
    }

    hideElement(delayDetails: DelayedDetails): void {
        this.#visibility = { action: 'hide', delayDetails }
    }

    addClass(classNames: string[], delayDetails: DelayedDetails): void {
        classNames.forEach((className) => {
            this.#classes.set(className, { action: 'add', delayDetails });
        })
    }

    removeClass(classNames: string[], delayDetails: DelayedDetails): void {
        classNames.forEach((className) => {
            this.#classes.set(className, { action: 'remove', delayDetails });
        })
    }

    addAttribute(attributes: string[], delayDetails: DelayedDetails): void {
        attributes.forEach((attribute) => {
            this.#attributes.set(attribute, { action: 'add', delayDetails });
        })
    }

    removeAttribute(attributes: string[], delayDetails: DelayedDetails): void {
        attributes.forEach((attribute) => {
            this.#attributes.set(attribute, { action: 'remove', delayDetails });
        })
    }

    getElement(): HTMLElement|SVGElement {
        return this.#element;
    }

    getClassesToAdd(): Array<{ name: string, delayDetails: DelayedDetails }> {
        return this.#filterMap(this.#classes, 'add');
    }

    getClassesToRemove(): Array<{ name: string, delayDetails: DelayedDetails }> {
        return this.#filterMap(this.#classes, 'remove');
    }

    getAttributesToAdd(): Array<{ name: string, delayDetails: DelayedDetails }> {
        return this.#filterMap(this.#attributes, 'add');
    }

    getAttributesToRemove(): Array<{ name: string, delayDetails: DelayedDetails }> {
        return this.#filterMap(this.#attributes, 'remove');
    }

    shouldShowElement(): boolean {
        if (!this.#visibility) {
            return false;
        }

        return this.#visibility.action === 'show';
    }

    shouldHideElement(): boolean {
        if (!this.#visibility) {
            return false;
        }

        return this.#visibility.action === 'hide';
    }

    getVisibilityDelay(): DelayedDetails {
        if (!this.#visibility) {
            throw new Error('No visibility change');
        }

        return this.#visibility.delayDetails;
    }

    #filterMap(map: Map<string, IndividualChangeDetails>, targetAction: string): Array<{ name: string, delayDetails: DelayedDetails }> {
        const matches: Array<{ name: string, delayDetails: DelayedDetails }> = [];
        map.forEach((details, name) => {
            if (details.action === targetAction) {
                matches.push({ name, delayDetails: details.delayDetails })
            }
        });

        return matches;
    }
}

interface LoadingAction {
    action: string,
    args: string[],
    delayDetails: DelayedDetails
}

export default class LoadingActionsCalculator {
    #activeLoadingActions: Map<HTMLElement|SVGElement, LoadingAction[]>;
    #inactiveLoadingActions: Map<HTMLElement|SVGElement, LoadingAction[]>;
    #newRequest: BackendRequest|null;

    #currentlyLoadingActions: string[] = [];
    #areAnyRequestsCurrentlyLoading: boolean;

    constructor(currentlyLoadingRequests: BackendRequest[], newRequest: BackendRequest|null = null) {
        this.#activeLoadingActions = new Map();
        this.#inactiveLoadingActions = new Map();
        this.#newRequest = newRequest;

        currentlyLoadingRequests.forEach((backendRequest) => {
            if (backendRequest.action) {
                this.#currentlyLoadingActions.push(backendRequest.action);
            }
        });
        this.#areAnyRequestsCurrentlyLoading = currentlyLoadingRequests.length > 0;
    }

    addLoadingDirective(element: HTMLElement|SVGElement, directive: Directive) {
        let delay = 0;
        const targetedActions: string[] = [];

        directive.modifiers.forEach((modifier => {
            switch (modifier.name) {
                case 'delay': {
                    delay = modifier.value ? parseInt(modifier.value) : 200;

                    break;
                }

                case 'action':
                    if (!modifier.value) {
                        throw new Error(`The "action" in data-loading must have an action name - e.g. action(foo). It's missing for ${directive.getString()}`)
                    }
                    targetedActions.push(modifier.value);
                    break;

                default:
                    throw new Error(`Unknown modifier ${modifier.name} used in the loading directive ${directive.getString()}`)
            }
        }));

        let shouldLoadingActionBeActive;
        if (targetedActions.length === 0) {
            // no action filtering? Then it's active as long as something is loading
            shouldLoadingActionBeActive = this.#areAnyRequestsCurrentlyLoading;
            // do not use the delay if there is NO new request happening
            if (!this.#newRequest) {
                delay = 0;
            }
        } else {
            // this loading targets one or more specific actions
            shouldLoadingActionBeActive = this.#areAnyOfTheseActionsCurrentlyLoading(targetedActions)
            // do not use the delay, unless there is a new request with a targeted action
            if (!this.#newRequest || !this.#newRequest.action || targetedActions.includes(this.#newRequest.action)) {
                delay = 0;
            }
        }

        const isStillLoading = (): boolean => {
            return this.#newRequest ? !this.#newRequest.isResolved() : false;
        };

        if (shouldLoadingActionBeActive) {
            const loadingActions = this.#activeLoadingActions.get(element) || [];
            loadingActions.push({
                action: directive.action,
                args: directive.args,
                delayDetails: { delay, isStillLoading },
            });
            this.#activeLoadingActions.set(element, loadingActions);
        } else {
            const loadingActions = this.#inactiveLoadingActions.get(element) || [];
            loadingActions.push({
                action: directive.action,
                args: directive.args,
                delayDetails: { delay, isStillLoading },
            });
            this.#inactiveLoadingActions.set(element, loadingActions);
        }
    }

    calculateInstructions(): LoadingInstructions[] {
        const instructionsList: Map<HTMLElement|SVGElement, LoadingCalculatorHelper> = new Map();
        // loop over inactive actions first
        this.#inactiveLoadingActions.forEach((loadingActions: LoadingAction[], element: HTMLElement|SVGElement) => {
            const instructions = instructionsList.get(element) || new LoadingCalculatorHelper(element);
            this.#parseActionsIntoInstructions(instructions, loadingActions);
        });
        // then over active actions, which will take precedence
        this.#activeLoadingActions.forEach((loadingActions: LoadingAction[], element: HTMLElement|SVGElement) => {
            const instructions = instructionsList.get(element) || new LoadingCalculatorHelper(element);
            this.#parseActionsIntoInstructions(instructions, loadingActions);
        });

        const finalInstructions: LoadingInstructions[] = [];
        instructionsList.forEach((helper: LoadingCalculatorHelper, element: HTMLElement|SVGElement) => {
            const instructions = new LoadingInstructions();
            Object.assign(instructions, {
                element,
                shouldShowElement: helper.shouldShowElement(),
                shouldHideElement: helper.shouldHideElement(),
                visibilityDelay: helper.getVisibilityDelay(),
                classesToAdd: helper.getClassesToAdd(),
                classesToRemove: helper.getClassesToRemove(),
                attributesToAdd: helper.getAttributesToAdd(),
                attributesToRemove: helper.getAttributesToRemove(),
            });
            finalInstructions.push(instructions);
        });

        return finalInstructions;
    }

    #parseActionsIntoInstructions(instructions: LoadingCalculatorHelper, loadingActions: LoadingAction[]): void {
        loadingActions.forEach((loadingAction: LoadingAction) => {
            switch (loadingAction.action) {
                case 'show':
                    instructions.showElement(loadingAction.delayDetails);
                    break;

                case 'hide':
                    instructions.hideElement(loadingAction.delayDetails);
                    break;

                case 'addClass':
                    instructions.addClass(loadingAction.args, loadingAction.delayDetails);
                    break;

                case 'removeClass':
                    instructions.removeClass(loadingAction.args, loadingAction.delayDetails);
                    break;

                case 'addAttribute':
                    instructions.addAttribute(loadingAction.args, loadingAction.delayDetails);
                    break;

                case 'removeAttribute':
                    instructions.removeAttribute(loadingAction.args, loadingAction.delayDetails);
                    break;

                default:
                    throw new Error(`Unknown loading action ${loadingAction.action}`);
            }
        });
    }

    /**
     * Are any of the targetedActions currently loading?
     */
    #areAnyOfTheseActionsCurrentlyLoading(targetedActions: string[]): boolean {
        return (this.#currentlyLoadingActions.filter(theAction =>  targetedActions.includes(theAction))).length > 0;
    }
}
