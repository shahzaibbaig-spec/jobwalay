import { describe,expect,it,vi } from 'vitest';
import sharp from 'sharp';
vi.mock('server-only',()=>({}));
import { normalizeCompanyImage } from '../src/modules/companies/server/images';
describe('company raster image boundary',()=>{
  it('rejects SVG and malformed input regardless of the supplied MIME type',async()=>{
    await expect(normalizeCompanyImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),'logo')).rejects.toThrow(/could not be decoded/);
    await expect(normalizeCompanyImage(Buffer.from('Not a JPEG'),'cover')).rejects.toThrow(/could not be decoded/);
    await expect(normalizeCompanyImage(Buffer.alloc(3*1024*1024+1),'cover')).rejects.toThrow(/up to 3 MiB/);
  });
  it('re-encodes valid raster data to a bounded WebP without metadata',async()=>{
    const input=await sharp({create:{width:900,height:700,channels:3,background:'#123456'}}).png().withMetadata().toBuffer();
    const output=await normalizeCompanyImage(input,'logo');
    const metadata=await sharp(output).metadata();
    expect(metadata.format).toBe('webp');expect(metadata.width).toBe(512);expect(metadata.height).toBe(512);
    expect(metadata.exif).toBeUndefined();expect(metadata.icc).toBeUndefined();
  });
});
