<?php

namespace Symfony\UX\LiveComponent\Util;

class FingerprintCalculator
{
    public function __construct(private string $secret)
    {
    }

    public function calculateFingerprint(array $data): string
    {
        return base64_encode(hash_hmac('sha256', serialize($data), $this->secret, true));
    }
}
