<?php

$builds = [];

$builds[] = ['php_version' => 7.2, 'path' => 'src/Chartjs', 'name' => 'Chartjs'];
$builds[] = ['php_version' => 7.2, 'path' => 'src/Cropperjs', 'name' => 'Cropperjs'];

echo json_encode(['include' => $builds]);
