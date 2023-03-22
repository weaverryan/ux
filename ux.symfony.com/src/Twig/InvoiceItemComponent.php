<?php

namespace App\Twig;

use App\Entity\InvoiceItem;
use App\Entity\Product;
use Symfony\UX\LiveComponent\Attribute\AsLiveComponent;
use Symfony\UX\LiveComponent\Attribute\LiveProp;
use Symfony\UX\LiveComponent\DefaultActionTrait;

#[AsLiveComponent('invoice_item')]
class InvoiceItemComponent
{
    use DefaultActionTrait;

    #[LiveProp(writable: true)]
    public Product $product;

    #[LiveProp(writable: true)]
    public int $quantity = 1;

    #[LiveProp]
    public InvoiceItem $invoiceItem;
}
