<?php
namespace App\Twig;

use App\Entity\Invoice;
use Symfony\UX\LiveComponent\Attribute\AsLiveComponent;
use Symfony\UX\LiveComponent\Attribute\LiveProp;
use Symfony\UX\LiveComponent\DefaultActionTrait;

#[AsLiveComponent('invoice')]
class InvoiceComponent
{
    use DefaultActionTrait;

    #[LiveProp(writable: ['customerName', 'customerEmail', 'taxRate'])]
    public Invoice $invoice;

    public function getTotal(): float
    {
        $taxMultiplier = 1 + ($this->invoice->getTaxRate() / 100);

        return $this->invoice->getSubtotal() * $taxMultiplier;
    }
}
