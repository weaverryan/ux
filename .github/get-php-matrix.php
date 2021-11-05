<?php

use Symfony\Component\Finder\Finder;

require __DIR__.'/../vendor/autoload.php';

$builds = [];

$finder = new Finder();
$finder->in(__DIR__.'/../src/*/')
    ->name('composer.json')
    ->notPath('/vendor/')
;

/**
 * A VERY ugly way to convert a composer constraint to a minor version.
 *
 * For example: ">=7.2.5" becomes "7.2"
 */
function extractPhpMinorVersion(array $composerData): ?string
{
    if (!isset($composerData['require'])) {
        return null;
    }

    if (!isset($composerData['require']['php'])) {
        throw new \Exception(sprintf('Missing "php" requirement for package "%s"', $composerData['name']));
    }

    $fullPhpVersion = preg_replace('/[^0-9.]/', '', $composerData['require']['php']);
    $parts = explode('.', $fullPhpVersion);

    return sprintf('%s.%s', $parts[0], $parts[1]);
}

const MAX_PHP_VERSION = '8.0';

foreach ($finder as $file) {
    $phpVersion = extractPhpMinorVersion(json_decode($file->getContents(), true));

    if (!$phpVersion) {
        // some packages have no php code
        continue;
    }

    $directory = $file->getPathInfo()->getPathname();
    $packagePath = substr($directory, strpos($directory, '../src/') + 7);

    $builds[] = [
        'build_name' => sprintf('%s PHP %s lowest deps', $packagePath, $phpVersion),
        'path' => 'src/'.$packagePath,
        'php_version' => $phpVersion,
        'composer_flags' => '--prefer-lowest',
    ];

    $builds[] = [
        'build_name' => sprintf('%s PHP %s highest deps', $packagePath, MAX_PHP_VERSION),
        'path' => 'src/'.$packagePath,
        'php_version' => MAX_PHP_VERSION,
        'composer_flags' => '',
    ];
}

echo json_encode(['include' => $builds]);
