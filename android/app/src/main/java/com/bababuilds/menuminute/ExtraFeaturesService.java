package com.bababuilds.menuminute;

import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;
import com.google.androidbrowserhelper.trusted.DelegationService;

/**
 * Exposes Google Play Billing to the trusted web origin through the Digital Goods API.
 * The app holds no billing logic: purchase tokens are sent to the MenuMinute server, which re-queries the
 * Google Play Developer API before any entitlement is granted.
 */
public class ExtraFeaturesService extends DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();
        registerExtraCommandHandler(new DigitalGoodsRequestHandler(getApplicationContext()));
    }
}
