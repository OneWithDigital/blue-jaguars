-- YouTube: the owner can connect the club channel with Google so unlisted
-- videos are imported too. The refresh token is stored encrypted and never sent
-- to the browser.
alter table dojo_settings add column if not exists youtube_token text not null default '';
alter table dojo_settings add column if not exists youtube_account text not null default '';
