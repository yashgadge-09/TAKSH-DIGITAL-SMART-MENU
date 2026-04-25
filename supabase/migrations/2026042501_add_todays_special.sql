-- Add the is_todays_special column to the dishes table
ALTER TABLE public.dishes ADD COLUMN IF NOT EXISTS is_todays_special BOOLEAN DEFAULT false;

-- Update the first available Soup
UPDATE public.dishes 
SET is_todays_special = true 
WHERE id IN (
  SELECT id FROM public.dishes 
  WHERE category ILIKE '%Soup%' 
  LIMIT 1
);

-- Update the first available Starter
UPDATE public.dishes 
SET is_todays_special = true 
WHERE id IN (
  SELECT id FROM public.dishes 
  WHERE category ILIKE '%Starter%' OR category ILIKE '%Tandoor%' OR category ILIKE '%Tikka%' 
  LIMIT 1
);

-- Update the first available Main Course
UPDATE public.dishes 
SET is_todays_special = true 
WHERE id IN (
  SELECT id FROM public.dishes 
  WHERE category ILIKE '%Main Course%' OR category ILIKE '%Maincourse%' OR category ILIKE '%Sabzi%' OR category ILIKE '%Paneer%'
  LIMIT 1
);

-- Update the first available Dessert
UPDATE public.dishes 
SET is_todays_special = true 
WHERE id IN (
  SELECT id FROM public.dishes 
  WHERE category ILIKE '%Dessert%' OR category ILIKE '%Sweet%'
  LIMIT 1
);
