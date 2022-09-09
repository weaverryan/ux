import BackendRequest from './BackendRequest';
import LoadingAction from "./LoadingAction";
import {getLoadingActionCallable} from "./loading_execution";

interface ElementLoadingDetails {
    element: HTMLElement|SVGElement,
    actionName: string,
    arg: string,
}

export default class LoadingCoordinator {
    readonly loadingElements: Map<HTMLElement|SVGElement, ElementLoadingActions>
    readonly backendRequestMap: Map<BackendRequest, Array<ElementLoadingDetails>>

    constructor() {
        this.loadingElements = new Map();
        this.backendRequestMap = new Map();
    }

    backendRequestStarted(backendRequest: BackendRequest) {
        backendRequest.loadingActions.forEach((loadingAction) => {
            // store the loading information, keyed by the Element
            const loadingActions = this.loadingElements.get(loadingAction.element) || new ElementLoadingActions(loadingAction.element);

            const performAction = () => {
                // don't trigger loading if the promise is already resolved
                if (backendRequest.isResolved()) {
                    return;
                }

                loadingActions.addAction(backendRequest, loadingAction);
                (getLoadingActionCallable(loadingAction))();
            }

            // perform the action now
            if (loadingAction.delay === 0) {
                performAction();

                return;
            }

            // or delay until later
            setTimeout(performAction, loadingAction.delay);
        });
    }

    backendRequestFinished(backendRequest: BackendRequest) {
        // TODO: read the new backendRequest.loadingActions and execute
        // "removeElementAction" below (should probably be private now)
        // get the final array of LoadingActions that SHOULD be reversed,
        // and reverse them
        // TODO: we also need to call this from the proper place in live_controller
    }


    // TODO: can be deleted after backendRequestStarted is finished
    addElementAction(element: HTMLElement|SVGElement, backendRequest: BackendRequest, actionName: string, arg = ''): void {
        // store the loading information, keyed by the Element
        const loadingActions = this.loadingElements.get(element) || new ElementLoadingActions(element);
        loadingActions.addAction(backendRequest, actionName, arg);

        // store the loading information keyed by the BackendRequest
        const elementLoadingDetails = this.backendRequestMap.get(backendRequest) || [];
        elementLoadingDetails.push({
            element,
            actionName,
            arg
        })
    }



    /**
     * Returns true if no other initiator is still triggering this action.
     * This means that it is now safe to execute the "reverse" of the action.
     *
     * @returns bool
     */
    removeElementAction(element: HTMLElement|SVGElement, initiator: BackendRequest, actionName: string, arg = ''): boolean {
        const loadingActions = this.loadingElements.get(element) || new ElementLoadingActions(element);

        return loadingActions.removeAction(initiator, actionName, arg);
    }
}

class ElementLoadingActions {
    readonly element: HTMLElement|SVGElement;
    readonly actions: Map<string, Array<BackendRequest>>

    constructor(element: HTMLElement|SVGElement) {
        this.element = element;
    }

    /**
     * @param loadingAction the "action" to perform on loading, like "show"
     * @param initiator  the ReRenderPromise that is causing this loading state
     */
    addAction(initiator: BackendRequest, loadingAction: LoadingAction): void {
        const key = loadingAction.calculateKey();

        const requestInitiators = this.actions.get(key) || [];
        requestInitiators.push(initiator);

        this.actions.set(key, requestInitiators);
    }

    /**
     * Returns true if no other initiator is still triggering this action.
     * This means that it is now safe to execute the "reverse" of the action.
     *
     * @returns bool
     */
    removeAction(initiator: BackendRequest, actionName: string, arg = ''): boolean {
        const key = this.#calculateKey(actionName, arg);

        const initiators = this.actions.get(key) || [];
        const index = initiators.indexOf(initiator);
        if (index > -1) {
            initiators.splice(index, 1);
        }

        return initiators.length === 0;
    }
}
