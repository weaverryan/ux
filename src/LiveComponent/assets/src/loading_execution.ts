import {
    addAttributes,
    addClass,
    removeAttributes,
    removeClass,
    setDisplayStyle
} from './dom_utils';
import LoadingAction from './LoadingAction';

export function getLoadingActionCallable(loadingAction: LoadingAction): () => void {
    const loadingActionName = parseLoadingAction(loadingAction.actionName, false);
    console.log(loadingActionName, loadingAction.actionName);

    return getLoadingCallable(loadingActionName, loadingAction.element, loadingAction.arg);
}

export function getReverseActionCallable(loadingAction: LoadingAction): () => void {
    const loadingActionName = parseLoadingAction(loadingAction.actionName, true);
    console.log(loadingActionName, loadingAction.actionName);

    return getLoadingCallable(loadingActionName, loadingAction.element, loadingAction.arg);
}

const parseLoadingAction = function(action: string, isReversed: boolean): string {
    switch (action) {
        case 'show':
            return isReversed ? 'hide' : 'show';
        case 'hide':
            return isReversed ? 'show' : 'hide';
        case 'addClass':
            return isReversed ? 'removeClass' : 'addClass';
        case 'removeClass':
            return isReversed ? 'addClass' : 'removeClass';
        case 'addAttribute':
            return isReversed ? 'removeAttribute' : 'addAttribute';
        case 'removeAttribute':
            return isReversed ? 'addAttribute' : 'removeAttribute';
    }

    throw new Error(`Unknown data-loading action "${action}"`);
}

const getLoadingCallable = function(finalAction: string, element: HTMLElement|SVGElement, arg: string): () => void {
    switch (finalAction) {
        case 'show':
            return () => {
                setDisplayStyle(element, 'inline-block');
            };

        case 'hide':
            return () => {
                setDisplayStyle(element, 'none');
            };

        case 'addClass':
            return () => addClass(element, [arg]);

        case 'removeClass':
            return () => removeClass(element, [arg]);

        case 'addAttribute':
            return () => addAttributes(element, [arg]);

        case 'removeAttribute':
            return () => removeAttributes(element, [arg]);

        default:
            throw new Error(`Unknown data-loading action "${finalAction}"`);
    }
}
