'use server';

/**
 * 国土地理院APIで住所から座標を取得
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
        const encodedAddress = encodeURIComponent(address);
        const response = await fetch(
            `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodedAddress}`
        );
        const data = await response.json();

        if (data && data.length > 0 && data[0].geometry?.coordinates) {
            const [lng, lat] = data[0].geometry.coordinates;
            return { lat, lng };
        }
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}
