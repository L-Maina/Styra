-- Makes Business.rating and Business.reviewCount match the reviews that exist.
--
-- Why: the review code (POST /api/reviews and booking confirm) keeps both columns up to date, but
-- reviews that were inserted by hand (seed or test data) did not. On the live database the one listed
-- business had 4 reviews averaging 4.0 while its row said rating 0 and reviewCount 0, so the
-- business page showed "0.0 (0 reviews)" next to a card that said 4 reviews.
--
-- Safe to run more than once: it only touches rows that differ. Run it in the Supabase SQL editor.

UPDATE "Business" AS b
SET "rating" = COALESCE(r.avg_rating, 0),
    "reviewCount" = COALESCE(r.review_count, 0)
FROM (
  SELECT biz.id,
         ROUND(AVG(rv."rating")::numeric, 2)::double precision AS avg_rating,
         COUNT(rv.id)::int AS review_count
  FROM "Business" biz
  LEFT JOIN "Review" rv ON rv."businessId" = biz.id
  GROUP BY biz.id
) AS r
WHERE r.id = b.id
  AND (b."rating" IS DISTINCT FROM COALESCE(r.avg_rating, 0)
       OR b."reviewCount" IS DISTINCT FROM COALESCE(r.review_count, 0));

-- Check afterwards: every row should show matching numbers.
-- SELECT b.name, b."rating", b."reviewCount", COUNT(rv.id) AS reviews, ROUND(AVG(rv."rating")::numeric, 2) AS avg_of_reviews
-- FROM "Business" b LEFT JOIN "Review" rv ON rv."businessId" = b.id GROUP BY b.id;
