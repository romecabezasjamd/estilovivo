import { describe, it, expect, vi } from 'vitest';

// Mock image processor
vi.mock('../imageProcessor.js', () => ({
  processImage: vi.fn().mockResolvedValue({
    original: 'test-original.jpg',
    thumbnail: 'test-thumb.webp',
    medium: 'test-medium.webp',
  }),
  getImageMetadata: vi.fn().mockResolvedValue({
    width: 800,
    height: 600,
    format: 'jpeg',
    size: 102400,
  }),
}));

describe('Image Processor', () => {
  it('should process images correctly', async () => {
    const { processImage } = await import('../imageProcessor.js');
    const result = await processImage('/tmp/test.jpg', '/uploads', 'test.jpg');
    
    expect(result).toHaveProperty('original');
    expect(result).toHaveProperty('thumbnail');
    expect(result).toHaveProperty('medium');
  });

  it('should get image metadata', async () => {
    const { getImageMetadata } = await import('../imageProcessor.js');
    const metadata = await getImageMetadata('/tmp/test.jpg');
    
    expect(metadata).toHaveProperty('width');
    expect(metadata).toHaveProperty('height');
    expect(metadata).toHaveProperty('format');
  });
});

describe('Validation Schemas', () => {
  it('should validate registerSchema correctly', async () => {
    const { registerSchema } = await import('../validators.js');
    
    const validData = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    };
    
    expect(() => registerSchema.parse(validData)).not.toThrow();
  });

  it('should reject invalid email in registerSchema', async () => {
    const { registerSchema } = await import('../validators.js');
    
    const invalidData = {
      email: 'not-an-email',
      password: 'password123',
      name: 'Test User',
    };
    
    expect(() => registerSchema.parse(invalidData)).toThrow();
  });

  it('should reject short password in registerSchema', async () => {
    const { registerSchema } = await import('../validators.js');
    
    const invalidData = {
      email: 'test@example.com',
      password: '12345',
      name: 'Test User',
    };
    
    expect(() => registerSchema.parse(invalidData)).toThrow();
  });

  it('should validate productSchema correctly', async () => {
    const { productSchema } = await import('../validators.js');
    
    const validData = {
      name: 'Test Product',
      category: 'top',
      color: 'blue',
      season: 'summer',
    };
    
    expect(() => productSchema.parse(validData)).not.toThrow();
  });

  it('should validate lookSchema correctly', async () => {
    const { lookSchema } = await import('../validators.js');
    
    const validData = {
      title: 'My Outfit',
      productIds: ['id1', 'id2'],
      isPublic: true,
    };
    
    expect(() => lookSchema.parse(validData)).not.toThrow();
  });
});
