-- Two kinds of sparring: point and continuous. Everything logged so far as
-- sparring was point sparring.
update students
set events = replace(events, 'Point Fighting', 'Point Sparring')
where events like '%Point Fighting%';

update mskc_results set discipline = 'Point Sparring' where discipline = 'Sparring';

update gallery_items set discipline = 'Point Sparring' where discipline = 'Sparring';
