<?php

namespace Symfony\UX\LiveComponent\Twig;

class AddressDto
{
    public function __construct(
        public ?string $street1 = null,
        public ?string $street2 = null,
        public ?string $city = null
    )
    {
    }
}
