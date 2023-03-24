<?php

/*
 * This file is part of the Symfony package.
 *
 * (c) Fabien Potencier <fabien@symfony.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Symfony\UX\LiveComponent\Metadata;

use Symfony\UX\LiveComponent\Attribute\LiveProp;

/**
 * @author Kevin Bond <kevinbond@gmail.com>
 *
 * @experimental
 *
 * @internal
 */
final class LivePropMetadata
{
    public function __construct(
        private string $name,
        private LiveProp $liveProp,
        private ?string $typeName,
        private bool $isBuiltIn,
        private bool $allowsNull,
    ) {
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getType(): ?string
    {
        return $this->typeName;
    }

    public function isBuiltIn(): bool
    {
        return $this->isBuiltIn;
    }

    public function allowsNull(): bool
    {
        return $this->allowsNull;
    }

    public function calculateFieldName(object $component, string $fallback): string
    {
        return $this->liveProp->calculateFieldName($component, $fallback);
    }

    /**
     * @return array<string>
     */
    public function writablePaths(): array
    {
        return $this->liveProp->writablePaths();
    }

    /**
     * @internal
     */
    public function hydrateMethod(): ?string
    {
        return $this->liveProp->hydrateMethod();
    }

    /**
     * @internal
     */
    public function dehydrateMethod(): ?string
    {
        return $this->liveProp->dehydrateMethod();
    }

    public function isIdentityWritable(): bool
    {
        return $this->liveProp->isIdentityWritable();
    }

    public function acceptUpdatesFromParent(): bool
    {
        return $this->liveProp->acceptUpdatesFromParent();
    }

    public function useSerializerForHydration(): bool
    {
        return $this->liveProp->useSerializerForHydration();
    }

    /**
     * @internal
     */
    public function serializationContext(): array
    {
        return $this->liveProp->serializationContext();
    }
}
