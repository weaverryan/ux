<?php

namespace App\Twig;

use App\Entity\Product;
use App\Repository\ProductRepository;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\UX\LiveComponent\Attribute\AsLiveComponent;
use Symfony\UX\LiveComponent\Attribute\LiveAction;
use Symfony\UX\LiveComponent\Attribute\LiveProp;
use Symfony\UX\LiveComponent\DefaultActionTrait;
use Symfony\UX\LiveComponent\LiveResponder;
use Symfony\UX\LiveComponent\ValidatableComponentTrait;
use Symfony\UX\TwigComponent\Attribute\ExposeInTemplate;

#[AsLiveComponent('invoice_item')]
class InvoiceItemComponent
{
    use DefaultActionTrait;
    use ValidatableComponentTrait;

    #[LiveProp(writable: true)]
    #[Assert\NotNull]
    public ?Product $product = null;

    #[LiveProp(writable: true)]
    #[Assert\Positive]
    public int $quantity = 1;

    #[LiveProp]
    public int $index;

    #[LiveProp(updateFromParent: false)]
    public bool $isEditing = false;

    public function __construct(private ProductRepository $productRepository)
    {
    }

    #[LiveAction]
    public function save(LiveResponder $responder): void
    {
        $this->validate();

        $responder->emitUp('item_save', [
            'index' => $this->index,
            'product' => $this->product->getId(),
            'quantity' => $this->quantity,
        ]);

        $this->isEditing = false;
    }

    #[LiveAction]
    public function edit(): void
    {
        $this->isEditing = true;
    }

    #[ExposeInTemplate]
    public function getProducts(): array
    {
        return $this->productRepository->findAll();
    }
}
