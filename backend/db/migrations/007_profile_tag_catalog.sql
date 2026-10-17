-- Keep the existing tag rows: published Boards can still reference their IDs.
-- Add the editorial catalog names used by profile settings and Board creation.
INSERT INTO tag (tag_name) VALUES
  ('Relax'), ('Foodie'), ('Hidden Gems'), ('City Life'),
  ('Slow Mornings'), ('By the Water'), ('Beach Days'), ('Island Hopping'),
  ('Road Trips'), ('Weekend Escapes'), ('Solo Travel'), ('Friends Trip'),
  ('Family Friendly'), ('Art & Design'), ('Local Life'), ('Café Hopping'),
  ('Wine & Dine'), ('Street Food'), ('Camping'), ('Winter Escapes'),
  ('Summer Days'), ('Off the Grid'), ('Sunsets'), ('Scenic Routes')
ON CONFLICT (tag_name) DO NOTHING;
