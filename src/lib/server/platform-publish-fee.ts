/** One-time platform fee when publishing a trip (USD). */
export const PLATFORM_PUBLISH_FEE_USD = 25;
export const PLATFORM_PUBLISH_FEE_CENTS = 2500;

export const PLATFORM_PUBLISH_DISCOUNT_CODE = 'BearsBestFriend#1';

export function shouldWaivePlatformFee(discountCode: string | undefined | null): boolean {
	if (discountCode == null) return false;
	return discountCode.trim() === PLATFORM_PUBLISH_DISCOUNT_CODE;
}
