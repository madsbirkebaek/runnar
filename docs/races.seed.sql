insert into public.races (id, name, city, country, distance_km, date, url) values
  (gen_random_uuid(), 'City 5K', 'Copenhagen', 'DK', 5, '2025-04-12', 'https://example.com/cph5k'),
  (gen_random_uuid(), 'Harbor 10K', 'Aarhus', 'DK', 10, '2025-05-10', 'https://example.com/aarhus10k'),
  (gen_random_uuid(), 'Summer Half Marathon', 'Odense', 'DK', 21.097, '2025-06-22', 'https://example.com/odensehm'),
  (gen_random_uuid(), 'Autumn Marathon', 'Copenhagen', 'DK', 42.195, '2025-09-28', 'https://example.com/cphmarathon');
