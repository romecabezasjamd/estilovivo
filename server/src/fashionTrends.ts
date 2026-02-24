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
        logger.info('Refreshing fashion trends from Vogue and GQ...');

        try {
            const [vogueRes, gqRes] = await Promise.all([
                fetch('https://www.vogue.es/feed/rss').then(r => r.text()),
                fetch('https://www.revistagq.com/feed/rss').then(r => r.text())
            ]);

            // Extraemos más items para poder filtrar y tener suficientes
            const vogueItems = vogueRes.split('<item>').slice(1, 15);
            const gqItems = gqRes.split('<item>').slice(1, 15);

            const fashionKeywords = ['moda', 'ropa', 'vestido', 'pantalón', 'pantalon', 'zapato', 'zapatilla', 'accesorio', 'tendencia', 'colección', 'coleccion', 'pasarela', 'look', 'estilo', 'prenda', 'chaqueta', 'abrigo', 'camisa', 'falda', 'bolso', 'color', 'diseñador'];

            const isFashionRelated = (text: string) => {
                const lower = text.toLowerCase();
                return fashionKeywords.some(kw => lower.includes(kw));
            };

            const vogueFashion = vogueItems.filter(item => isFashionRelated(item)).slice(0, 4).map(item => ({ item, source: 'Vogue España (Moda Mujer)' }));
            const gqFashion = gqItems.filter(item => isFashionRelated(item)).slice(0, 4).map(item => ({ item, source: 'GQ España (Moda Hombre)' }));

            const allItems = [
                ...vogueFashion,
                ...gqFashion
            ];

            const newTrends: FashionTrend[] = allItems.map(({ item, source }, index) => {
                const title = this.extractTag(item, 'title');
                const link = this.extractTag(item, 'link');
                const description = this.extractTag(item, 'description').replace(/<[^>]*>?/gm, '');
                const category = this.extractTag(item, 'category') || 'Moda';

                let image = this.extractAttribute(item, 'media:thumbnail', 'url') ||
                    this.extractAttribute(item, 'media:content', 'url') ||
                    this.extractAttribute(item, 'enclosure', 'url') ||
                    'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=800';

                const keywords = this.extractTag(item, 'media:keywords');
                const tags = keywords ? keywords.split(',').map(s => s.trim()) : ['Moda', 'Tendencias'];

                return {
                    id: `trend-${Date.now()}-${index}`,
                    title: title || 'Tendencia de Moda',
                    category: category,
                    description: description || 'Descubre lo último en las pasarelas y el street style internacional.',
                    image: image,
                    tags: tags.slice(0, 3),
                    source: source,
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
