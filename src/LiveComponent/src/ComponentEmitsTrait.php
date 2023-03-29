<?php

/*
 * This file is part of the Symfony package.
 *
 * (c) Fabien Potencier <fabien@symfony.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Symfony\UX\LiveComponent;

/**
 * @author Ryan Weaver <ryan@symfonycasts.com>
 *
 * @experimental
 */
trait ComponentEmitsTrait
{
    private LiveResponder $liveResponderForEmit;

    /**
     * @internal
     *
     * @required
     */
    public function setLiveResponderForEmit(LiveResponder $liveResponder): void
    {
        $this->liveResponderForEmit = $liveResponder;
    }

    public function emit(string $eventName, array $data, string $componentName = null): void
    {
        $this->liveResponderForEmit->emit($eventName, $data, $componentName);
    }

    public function emitUp(string $eventName, array $data = [], string $componentName = null): void
    {
        $this->liveResponderForEmit->emitUp($eventName, $data, $componentName);
    }

    public function emitSelf(string $eventName, array $data): void
    {
        $this->liveResponderForEmit->emitSelf($eventName, $data);
    }
}
