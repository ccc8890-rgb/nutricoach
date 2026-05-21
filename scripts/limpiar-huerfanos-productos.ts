#!/usr/bin/env tsx
/**
 * Elimina productos_supermercado que referencian alimentos eliminados.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createServiceSupabase } from '../lib/supabase-server';

async function main() {
  const supabase = createServiceSupabase();

  const { data: all } = await supabase
    .from('productos_supermercado')
