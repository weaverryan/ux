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

    #[LiveProp]
    public int $key;

    #[LiveProp(writable: true)]
    #[Assert\NotNull]
    public ?Product $product = null;

    #[LiveProp(writable: true)]
    #[Assert\Positive]
    public int $quantity = 1;

    #[LiveProp()]
    public bool $isEditing = false;

    public function __construct(private ProductRepository $productRepository)
    {
    }

    public function mount(?int $productId): void
    {
        if ($productId) {
            $this->product = $this->productRepository->find($productId);
        }
    }

    #[LiveAction]
    public function save(LiveResponder $responder): void
    {
        $this->validate();

        $responder->emitUp('item_save', [
            'key' => $this->key,
            'product' => $this->product->getId(),
            'quantity' => $this->quantity,
        ]);

        $this->isEditing = false;
    }

    #[LiveAction]
    public function edit(): void
    {
        // TODO: do we also (or only) emit an event to keep the parent component in sync?
        $this->isEditing = true;
    }

    #[ExposeInTemplate]
    public function getProducts(): array
    {
        return $this->productRepository->findAll();
    }
}
