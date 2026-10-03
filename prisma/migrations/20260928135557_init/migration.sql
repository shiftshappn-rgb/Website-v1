-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'paid', 'fulfilled', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('percent', 'fixed', 'free_shipping');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "BlogStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('superadmin', 'editor', 'support');

-- CreateEnum
CREATE TYPE "HomepageBlockType" AS ENUM ('hero', 'marquee', 'quickShopRow', 'categoryDuo', 'productGrid', 'bundleBanner', 'sizeFinderStrip', 'fabricCallout', 'brandStory', 'reviewHighlight', 'valuePropsRow', 'giftCardBanner');

-- CreateEnum
CREATE TYPE "BundleDiscountType" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "GiftCardStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "GiftCardSource" AS ENUM ('admin', 'purchase');

-- CreateEnum
CREATE TYPE "OrderLineType" AS ENUM ('product', 'gift_card');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('hospital', 'clinic', 'other');

-- CreateTable
CREATE TABLE "DeliveryLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL DEFAULT 'other',
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Halifax',
    "province" TEXT NOT NULL DEFAULT 'NS',
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'CA',
    "freeDelivery" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryTimeSlot" (
    "id" TEXT NOT NULL,
    "deliveryLocationId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maxOrders" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DeliveryTimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'draft',
    "basePrice" DECIMAL(10,2) NOT NULL,
    "compareAtPrice" DECIMAL(10,2),
    "categoryId" TEXT,
    "fabricTypeId" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoImage" TEXT,
    "fitSummary" TEXT,
    "careInstructions" TEXT,
    "lengthGuide" TEXT,
    "offerLengths" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "priceOverride" DECIMAL(10,2),
    "inventoryQty" INTEGER NOT NULL DEFAULT 0,
    "images" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentCategoryId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductProfession" (
    "productId" TEXT NOT NULL,
    "professionId" TEXT NOT NULL,

    CONSTRAINT "ProductProfession_pkey" PRIMARY KEY ("productId","professionId")
);

-- CreateTable
CREATE TABLE "FabricType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "iconOrImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FabricType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogColor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "heroImage" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCollection" (
    "productId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId")
);

-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "discountType" "BundleDiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleProduct" (
    "bundleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BundleProduct_pkey" PRIMARY KEY ("bundleId","productId")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'CA',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "email" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "shipping" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "stripePaymentIntentId" TEXT,
    "stripeSessionId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "shippingAddress" JSONB NOT NULL,
    "billingAddress" JSONB,
    "deliveryLocationId" TEXT,
    "deliveryTimeSlotId" TEXT,
    "shippingMethod" TEXT,
    "shippingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "lineType" "OrderLineType" NOT NULL DEFAULT 'product',
    "productVariantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "priceAtPurchase" DECIMAL(10,2) NOT NULL,
    "productName" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "verifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "photos" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "minSpend" DECIMAL(10,2),
    "expiresAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "bodyRichText" TEXT NOT NULL,
    "coverImage" TEXT,
    "author" TEXT,
    "status" "BlogStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomepageBlock" (
    "id" TEXT NOT NULL,
    "type" "HomepageBlockType" NOT NULL,
    "order" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "HomepageBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'editor',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyOffer" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "ctaLabel" TEXT NOT NULL DEFAULT 'Shop now',
    "ctaHref" TEXT NOT NULL DEFAULT '/shop',
    "discountCode" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "initialAmount" DECIMAL(10,2) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,
    "purchaserEmail" TEXT,
    "recipientEmail" TEXT,
    "note" TEXT,
    "source" "GiftCardSource" NOT NULL DEFAULT 'admin',
    "orderId" TEXT,
    "status" "GiftCardStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyLedger" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTimeSlot_deliveryLocationId_dayOfWeek_startTime_key" ON "DeliveryTimeSlot"("deliveryLocationId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Profession_slug_key" ON "Profession"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FabricType_slug_key" ON "FabricType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogColor_name_key" ON "CatalogColor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogColor_slug_key" ON "CatalogColor"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Bundle_slug_key" ON "Bundle"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_cloudinaryPublicId_key" ON "MediaAsset"("cloudinaryPublicId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyPage_slug_key" ON "PolicyPage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSetting_key_key" ON "SiteSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_code_key" ON "GiftCard"("code");

-- AddForeignKey
ALTER TABLE "DeliveryTimeSlot" ADD CONSTRAINT "DeliveryTimeSlot_deliveryLocationId_fkey" FOREIGN KEY ("deliveryLocationId") REFERENCES "DeliveryLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_fabricTypeId_fkey" FOREIGN KEY ("fabricTypeId") REFERENCES "FabricType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductProfession" ADD CONSTRAINT "ProductProfession_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductProfession" ADD CONSTRAINT "ProductProfession_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCollection" ADD CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCollection" ADD CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleProduct" ADD CONSTRAINT "BundleProduct_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleProduct" ADD CONSTRAINT "BundleProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryLocationId_fkey" FOREIGN KEY ("deliveryLocationId") REFERENCES "DeliveryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryTimeSlotId_fkey" FOREIGN KEY ("deliveryTimeSlotId") REFERENCES "DeliveryTimeSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedger" ADD CONSTRAINT "LoyaltyLedger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
