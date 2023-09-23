# [ux.symfony.com](https://ux.symfony.com)

Source code for [ux.symfony.com](https://ux.symfony.com).

## AssetMapper CSS Testing

- in `base.html.twig`, `{{ import('app') }}` indicates that `app` is the entrypoint.
- Any JavaScript files that it (non-lazily) imports (or its imports import) are given
   `preload=true`.
- Any CSS files that it (non-lazily) imports (or its imports import) are rendered
   as `<link rel="stylesheet" href="...">` tags in the HTML.
- Thanks to code in `app.js`, after 2 seconds, a lazy JS file is imported, which
   also triggers `red_background.css` to be imported.

## Contributing

### Local Development

1. Install the project:
    ```bash
    git clone git@github.com:symfony/ux
    cd ux/ux.symfony.com/
    ```

2. Install the dependencies:
    ```bash
    symfony composer install
    ```

3. (optional) Configure Docker:
    ```bash
    docker compose up -d
    ```

5. Run database migrations:
    ```bash
    symfony console doctrine:migration:migrate
    ```

6. Populate the database:
    ```bash
    symfony console app:load-data
    ```

7. Compile the Sass files:
    ```bash
    symfony console sass:build --watch
    ```

8. Start the web server:
    ```bash
    symfony server:start -d
    ```


### Running the Test Suite

```bash
symfony php bin/phpunit
```
