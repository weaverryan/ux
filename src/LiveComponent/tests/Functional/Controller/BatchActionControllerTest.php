<?php

/*
 * This file is part of the Symfony package.
 *
 * (c) Fabien Potencier <fabien@symfony.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Symfony\UX\LiveComponent\Tests\Functional\Controller;

use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\UX\LiveComponent\Tests\LiveComponentTestHelper;
use Zenstruck\Browser\KernelBrowser;
use Zenstruck\Browser\Response\HtmlResponse;
use Zenstruck\Browser\Test\HasBrowser;

/**
 * @author Kevin Bond <kevinbond@gmail.com>
 */
final class BatchActionControllerTest extends KernelTestCase
{
    use HasBrowser;
    use LiveComponentTestHelper;

    public function testCanBatchActions(): void
    {
        $dehydrated = $this->dehydrateComponent($this->mountComponent('with_actions'));

        $this->browser()
            ->throwExceptions()
            ->get('/_components/with_actions', ['json' => ['data' => $dehydrated]])
            ->assertSuccessful()
            ->assertSee('initial')
            ->use(function (HtmlResponse $response, KernelBrowser $browser) {
                $browser->post('/_components/with_actions/add', [
                    'json' => [
                        'data' => json_decode($response->crawler()->filter('ul')->first()->attr('data-live-data-value')),
                        'args' => ['what' => 'first'],
                    ],
                    'headers' => ['X-CSRF-TOKEN' => $response->crawler()->filter('ul')->first()->attr('data-live-csrf-value')],
                ]);
            })
            ->assertSee('initial')
            ->assertSee('first')
            ->use(function (HtmlResponse $response, KernelBrowser $browser) {
                $browser->post('/_components/with_actions/_batch', [
                    'json' => [
                        'data' => json_decode($response->crawler()->filter('ul')->first()->attr('data-live-data-value')),
                        'actions' => [
                            ['name' => 'add', 'args' => ['what' => 'second']],
                            ['name' => 'add', 'args' => ['what' => 'third']],
                            ['name' => 'add', 'args' => ['what' => 'fourth']],
                        ],
                    ],
                    'headers' => ['X-CSRF-TOKEN' => $response->crawler()->filter('ul')->first()->attr('data-live-csrf-value')],
                ]);
            })
            ->assertSee('initial')
            ->assertSee('first')
            ->assertSee('second')
            ->assertSee('third')
            ->assertSee('fourth')
        ;
    }

    public function testCsrfTokenIsChecked(): void
    {
        $this->markTestIncomplete();
    }

    public function testMustBeLiveComponent(): void
    {
        $this->markTestIncomplete();
    }

    public function testRedirect(): void
    {
        $this->markTestIncomplete();
    }

    public function testException(): void
    {
        $this->markTestIncomplete();
    }
}
