import {
    addAttributes,
    addClass,
    removeAttributes,
    removeClass,
    setDisplayStyle
} from './dom_utils';
import LoadingAction from './LoadingAction';

export function getLoadingActionCallable(element: HTMLElement|SVGElement, action: string, args: string[]): () => void {
    const loadingActionName = parseLoadingAction(action, false);

    return getLoadingCallable(loadingActionName, element, args);
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

const getLoadingCallable = function(finalAction: string, element: HTMLElement|SVGElement, args: string[]): () => void {
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
            return () => addClass(element, args);

        case 'removeClass':
            return () => removeClass(element, args);

        case 'addAttribute':
            return () => addAttributes(element, args);

        case 'removeAttribute':
            return () => removeAttributes(element, args);

        default:
            throw new Error(`Unknown data-loading action "${finalAction}"`);
    }
}
