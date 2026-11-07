import 'server-only';
import sharp from 'sharp';
import { DomainError } from '@/lib/errors';
export async function normalizeCompanyImage(input:Buffer,kind:'logo'|'cover') {
  if(!input.length||input.length>3*1024*1024) throw new DomainError('Choose an image up to 3 MiB.');
  try {
    const image=sharp(input,{limitInputPixels:20_000_000,animated:false});
    const metadata=await image.metadata();
    if(!['png','jpeg','webp'].includes(metadata.format??'')||(metadata.pages??1)>1) throw new Error('Unsupported format');
    return await image.rotate().resize(kind==='logo'?512:1600,kind==='logo'?512:600,{fit:'cover',withoutEnlargement:true}).webp({quality:85}).toBuffer();
  } catch { throw new DomainError('The image could not be decoded. Use a static PNG, JPEG or WebP under 20 megapixels.'); }
}
