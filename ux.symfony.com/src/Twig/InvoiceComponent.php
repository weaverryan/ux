<?php
namespace App\Twig;

use App\Entity\Invoice;
use App\Entity\InvoiceItem;
use App\Entity\Product;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Validator\Constraints\Valid;
use Symfony\UX\LiveComponent\Attribute\AsLiveComponent;
use Symfony\UX\LiveComponent\Attribute\LiveAction;
use Symfony\UX\LiveComponent\Attribute\LiveArg;
use Symfony\UX\LiveComponent\Attribute\LiveListener;
use Symfony\UX\LiveComponent\Attribute\LiveProp;
use Symfony\UX\LiveComponent\Attribute\PreReRender;
use Symfony\UX\LiveComponent\DefaultActionTrait;
use Symfony\UX\LiveComponent\ValidatableComponentTrait;

#[AsLiveComponent('invoice')]
class InvoiceComponent extends AbstractController
{
    use DefaultActionTrait;
    use ValidatableComponentTrait;

    #[LiveProp(writable: ['customerName', 'customerEmail', 'taxRate', 'invoiceItems'])]
    #[Valid]
    public Invoice $invoice;

    public ?InvoiceItem $newItem = null;

    #[LiveAction]
    public function addItem(): void
    {
        dump($this->invoice->getInvoiceItems()->count());
        $item = new InvoiceItem();
        $this->invoice->addInvoiceItem($item);
        $this->newItem = $item;
        dump($this->invoice->getInvoiceItems()->count());
    }

    #[LiveListener('item_remove')]
    public function removeInvoiceItem(#[LiveArg] int $index): void
    {
        $item = $this->invoice->getInvoiceItems()[$index];
        if ($item) {
            $this->invoice->removeInvoiceItem($item);
        }
    }

    #[LiveListener('item_save')]
    public function saveInvoiceItem(#[LiveArg] int $index, #[LiveArg] Product $product, #[LiveArg] int $quantity): void
    {
        $item = $this->invoice->getInvoiceItems()->get($index);
        if (!$item) {
            // shouldn't happen
            return;
        }

        $item->setProduct($product);
        $item->setQuantity($quantity);
    }

    #[LiveAction]
    public function saveInvoice(EntityManagerInterface $entityManager): Response
    {
        $this->validate();

        // invoice items save thanks to cascade: ['persist']
        $entityManager->persist($this->invoice);
        $entityManager->flush();

        $this->addFlash('live_demo_success', 'Invoice saved!');

        return $this->redirectToRoute('app_live_components_invoice', [
            'id' => $this->invoice->getId()
        ]);
    }

    public function getSubtotal(): float
    {
        $subTotal = 0;

        // loop over all saved invoice items
        foreach ($this->invoice->getInvoiceItems() as $invoiceItem) {
            $subTotal += $invoiceItem->getSubtotal();
        }

        return $subTotal / 100;
    }

    public function getTotal(): float
    {
        $taxMultiplier = 1 + ($this->invoice->getTaxRate() / 100);

        return $this->getSubtotal() * $taxMultiplier;
    }
}
