<?php

namespace Symfony\UX\LiveComponent\Twig;

use Symfony\UX\LiveComponent\Attribute\AsLiveComponent;
use Symfony\UX\LiveComponent\Attribute\LiveProp;

#[AsLiveComponent('hydration_test')]
class HydrationTestComponent
{
    #[LiveProp]
    public string $name;

#[LiveProp(
    dehydrateWith: 'dehydrateAddress',
    hydrateWith: 'hydrateAddress',
    writable: ['street1', 'street2']
)]
public AddressDto $dto;

    public function dehydrateAddress(AddressDto $addressDto)
    {
        return [
            'street1' => $addressDto->street1,
            'street2' => $addressDto->street2,
            'city' => $addressDto->city,
        ];
    }
    public function hydrateAddress(array $address)
    {
        return new AddressDto(
            $address['street1'],
            $address['street2'],
            $address['city']
        );
    }
}
