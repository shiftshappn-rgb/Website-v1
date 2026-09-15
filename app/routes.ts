import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  layout("routes/storefront-layout.tsx", [
    index("routes/home.tsx"),
    ...prefix("shop", [
      index("routes/shop-index.tsx"),
      route("women", "routes/shop-women.tsx"),
      route("men", "routes/shop-men.tsx"),
      route("colour", "routes/shop-colour.tsx"),
      route("fabric", "routes/shop-fabric.tsx"),
    ]),
    route("products/:slug", "routes/product-detail.tsx"),
    route("collections/:slug", "routes/collection-detail.tsx"),
    ...prefix("blog", [
      index("routes/blog-index.tsx"),
      route(":slug", "routes/blog-post.tsx"),
    ]),
    route("about", "routes/about.tsx"),
    route("faq", "routes/faq.tsx"),
    route("contact", "routes/contact.tsx"),
    route("community", "routes/community.tsx"),
    route("gift-cards", "routes/gift-cards.tsx"),
    route("size-chart", "routes/size-chart.tsx"),
    route("policies/:slug", "routes/policy-page.tsx"),
    ...prefix("account", [
      index("routes/account.tsx"),
      route("orders", "routes/account-orders.tsx"),
      route("addresses", "routes/account-addresses.tsx"),
      route("rewards", "routes/account-rewards.tsx"),
    ]),
    ...prefix("auth", [
      route("login", "routes/auth-login.tsx"),
      route("register", "routes/auth-register.tsx"),
      route("logout", "routes/auth-logout.tsx"),
    ]),
  ]),
  route("checkout/success", "routes/checkout-success.tsx"),
  route("api/checkout", "routes/api-checkout.ts"),
  route("api/webhook", "routes/api-webhook.ts"),
  route("sitemap.xml", "routes/sitemap.ts"),
  route("robots.txt", "routes/robots.ts"),
  route(
    ".well-known/appspecific/com.chrome.devtools.json",
    "routes/chrome-devtools-well-known.ts"
  ),
  ...prefix("admin", [
    route("login", "routes/admin-login.tsx"),
    route("api/cloudinary-sign", "routes/api-admin-cloudinary-sign.ts"),
    layout("routes/admin-layout.tsx", [
      index("routes/admin-dashboard.tsx"),
      ...prefix("products", [
        index("routes/admin-products-index.tsx"),
        route("new", "routes/admin-products-new.tsx"),
        route(":id", "routes/admin-products-edit.tsx"),
      ]),
      route("categories", "routes/admin-categories.tsx"),
      route("colors", "routes/admin-colors.tsx"),
      route("collections", "routes/admin-collections.tsx"),
      ...prefix("orders", [
        index("routes/admin-orders-index.tsx"),
        route(":id", "routes/admin-orders-detail.tsx"),
      ]),
      route("customers", "routes/admin-customers.tsx"),
      ...prefix("blog", [
        index("routes/admin-blog-index.tsx"),
        route("new", "routes/admin-blog-new.tsx"),
        route(":id", "routes/admin-blog-edit.tsx"),
      ]),
      route("homepage-blocks", "routes/admin-homepage-blocks.tsx"),
      route("discounts", "routes/admin-discounts.tsx"),
      route("offers", "routes/admin-offers.tsx"),
      route("gift-cards", "routes/admin-gift-cards.tsx"),
      route("loyalty", "routes/admin-loyalty.tsx"),
      route("community", "routes/admin-community.tsx"),
      route("media", "routes/admin-media.tsx"),
      route("reviews", "routes/admin-reviews.tsx"),
      route("settings", "routes/admin-settings.tsx"),
      route("logout", "routes/admin-logout.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
