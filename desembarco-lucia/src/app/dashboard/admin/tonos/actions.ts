'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

export async function upsertBrandToneAction(input: {
  brand: string;
  voice: string;
  examples?: string;
}) {
  const brand = input.brand.trim();
  const voice = input.voice.trim();
  const examples = input.examples?.trim() || null;

  if (!brand) return { ok: false as const, error: 'Falta el nombre de marca' };
  if (voice.length < 30) {
    return { ok: false as const, error: 'El voice tiene que tener al menos 30 caracteres' };
  }

  await prisma.brandTone.upsert({
    where: { brand },
    create: { brand, voice, examples },
    update: { voice, examples },
  });

  revalidatePath('/dashboard/admin/tonos');
  return { ok: true as const };
}

export async function deleteBrandToneAction(brand: string) {
  await prisma.brandTone.delete({ where: { brand } });
  revalidatePath('/dashboard/admin/tonos');
  return { ok: true as const };
}
