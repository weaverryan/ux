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

    return getLoadingCallable(loadingActionName, loadingAction.element, loadingAction.arg);
}

export function getReverseActionCallable(loadingAction: LoadingAction): () => void {
    const loadingActionName = parseLoadingAction(loadingAction.actionName, true);

    return getLoadingCallable(loadingActionName, loadingAction.element, loadingAction.arg);
}

const parseLoadingAction = function(action: string, isReversed: boolean) {
    switch (action) {
        case 'show':
            return isReversed ? 'show' : 'hide';
        case 'hide':
            return isReversed ? 'hide' : 'show';
        case 'addClass':
            return isReversed ? 'addClass' : 'removeClass';
        case 'removeClass':
            return isReversed ? 'removeClass' : 'addClass';
        case 'addAttribute':
            return isReversed ? 'addAttribute' : 'removeAttribute';
        case 'removeAttribute':
            return isReversed ? 'removeAttribute' : 'addAttribute';
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
