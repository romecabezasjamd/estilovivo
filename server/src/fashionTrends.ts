import logger from './logger.js';

interface FashionTrend {
    id: string;
    title: string;
    category: string;
    description: string;
    image: string;
    tags: string[];
    source: string;
    link?: string;
}

class FashionTrendService {
    private trends: FashionTrend[] = [];
    private lastUpdate: number = 0;
    private CACHE_DURATION = 1000 * 60 * 60; // 1 hora

    async getTrends(): Promise<FashionTrend[]> {
        const now = Date.now();
        if (this.trends.length > 0 && (now - this.lastUpdate) < this.CACHE_DURATION) {
            return this.trends;
        }

        try {
            await this.refreshTrends();
        } catch (error) {
            logger.error('Error refreshing fashion trends:', error);
            // If refresh fails but we have old trends, return them
            if (this.trends.length === 0) {
                return this.getFallbackTrends();
            }
        }

        return this.trends;
    }

    private async refreshTrends() {
        logger.info('Refreshing fashion trends from source...');

        try {
            // Usamos el feed de Vogue como fuente fiable y verificable
            const response = await fetch('https://www.vogue.com/feed/rss');
            const xml = await response.text();

            // Parseo básico de RSS para evitar dependencias pesadas
            const items = xml.split('<item>').slice(1);

            const newTrends: FashionTrend[] = items.slice(0, 4).map((item, index) => {
                const title = this.extractTag(item, 'title');
                const link = this.extractTag(item, 'link');
                const description = this.extractTag(item, 'description').replace(/<[^>]*>?/gm, '').substring(0, 150) + '...';

                // Intentar extraer imagen del media:content o enclosure
                let image = this.extractAttribute(item, 'media:content', 'url') ||
                    this.extractAttribute(item, 'media:thumbnail', 'url') ||
                    this.extractAttribute(item, 'enclosure', 'url') ||
                    'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=800';

                return {
                    id: `trend-${Date.now()}-${index}`,
                    title: title || 'Tendencia de Moda',
                    category: 'Editorial',
                    description: description || 'Descubre lo último en las pasarelas y el street style internacional.',
                    image: image,
                    tags: ['Actualidad', 'Vogue', 'Tendencias'],
                    source: 'Vogue Fashion',
                    link: link
                };
            });

            if (newTrends.length > 0) {
                this.trends = newTrends;
                this.lastUpdate = Date.now();
            } else {
                this.trends = this.getFallbackTrends();
            }
        } catch (e) {
            this.trends = this.getFallbackTrends();
            throw e;
        }
    }

    private extractTag(xml: string, tag: string): string {
        const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 's'));
        return match ? match[1].trim() : '';
    }

    private extractAttribute(xml: string, tag: string, attr: string): string {
        const match = xml.match(new RegExp(`<${tag}[^>]*${attr}=["'](.*?)["']`, 'i'));
        return match ? match[1] : '';
    }

    private getFallbackTrends(): FashionTrend[] {
        // Tendencias de backup por si falla la conexión
        return [
            {
                id: 'f1',
                title: 'Maximalismo Sensorial',
                category: 'Textura',
                description: 'Mezcla audaz de texturas como bouclé y ante. La moda de 2026 se centra en la experiencia táctil.',
                image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=800',
                tags: ['Texturas', '2026', 'Moda'],
                source: 'Estilo Vivo Insights'
            },
            {
                id: 'f2',
                title: 'Rojo Cereza Profundo',
                category: 'Color',
                description: 'El color absoluto de la temporada. Visto en abrigos estructurados y accesorios de piel.',
                image: 'https://images.unsplash.com/photo-1506152983158-b4a74a01c721?auto=format&fit=crop&q=80&w=800',
                tags: ['Color', 'Tendencia', 'WGSN'],
                source: 'Pantone Fashion'
            }
        ];
    }
}

export const fashionTrendsService = new FashionTrendService();
