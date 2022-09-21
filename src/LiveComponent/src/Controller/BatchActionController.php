<?php

/*
 * This file is part of the Symfony package.
 *
 * (c) Fabien Potencier <fabien@symfony.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Symfony\UX\LiveComponent\Controller;

use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\HttpKernelInterface;
use Symfony\UX\LiveComponent\LiveComponentHydrator;
use Symfony\UX\TwigComponent\ComponentFactory;

/**
 * @author Kevin Bond <kevinbond@gmail.com>
 *
 * @internal
 */
final class BatchActionController
{
    public function __construct(
        private HttpKernelInterface $kernel,
        private ComponentFactory $factory,
        private LiveComponentHydrator $hydrator,
    ) {
    }

    public function __invoke(Request $request, string $component): Response
    {
        try {
            $json = json_decode($request->getContent(), true, 512, \JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new BadRequestHttpException('Invalid JSON');
        }

        $data = $json['data'] ?? throw new BadRequestHttpException('Invalid JSON');
        $actions = $json['actions'] ?? throw new BadRequestHttpException('Invalid JSON');

        if (!\is_array($actions) || !$actions) {
            throw new BadRequestHttpException('Invalid JSON');
        }

        $componentObject = $this->factory->get($component);
        $mountedComponent = $this->hydrator->hydrate($componentObject, $data, $component);
        $response = null;

        // todo ensure live
        // todo check csrf token

        foreach ($actions as $action) {
            $name = $action['name'] ?? throw new BadRequestHttpException('Invalid JSON');

            $subRequest = $request->duplicate(attributes: [
                '_controller' => [$componentObject, $name],
                '_mounted_component' => $mountedComponent,
                '_component_action_args' => $action['args'] ?? [],
                '_route' => 'live_component',
            ]);
            // todo - only render on final action

            $response = $this->kernel->handle($subRequest, HttpKernelInterface::SUB_REQUEST);

            // todo - handle redirect
        }

        return $response;
    }
}
