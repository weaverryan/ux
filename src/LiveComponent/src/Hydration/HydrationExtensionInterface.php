<?php

namespace Symfony\UX\LiveComponent\Hydration;

interface HydrationExtensionInterface
{
    public function supports(string $className): bool;

    public function hydrate(mixed $value, string $className): ?object;

    /**
     * Returns a scalar value that can be used to hydrate the object later.
     */
    public function dehydrate(object $object): mixed;
}
