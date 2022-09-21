<?php

namespace Symfony\UX\LiveComponent\Tests\Fixtures\Component;

use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\UX\LiveComponent\Attribute\AsLiveComponent;
use Symfony\UX\LiveComponent\Attribute\LiveAction;
use Symfony\UX\LiveComponent\Attribute\LiveArg;
use Symfony\UX\LiveComponent\Attribute\LiveProp;
use Symfony\UX\LiveComponent\DefaultActionTrait;

#[AsLiveComponent('with_actions')]
final class WithActions
{
    use DefaultActionTrait;

    #[LiveProp]
    public array $items = ['initial'];

    #[LiveAction]
    public function add(#[LiveArg] string $what, UrlGeneratorInterface $router): void
    {
        $this->items[] = $what;
    }
}
