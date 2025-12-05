import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User } from '@/models/User';
import Whop from '@whop/sdk';

export const runtime = 'nodejs';

const WHOP_API_KEY = process.env.WHOP_API_KEY || '';
const EDGEIQ_COMPANY_ID = process.env.NEXT_PUBLIC_WHOP_COMPANY_ID || '';
// Product ID in Whop that represents the "follow plays" product
// You must set this in your environment (server-side) configuration.
const WHOP_FOLLOW_PRODUCT_ID = process.env.WHOP_FOLLOW_PRODUCT_ID || '';

// Reuse a single Whop client instance across requests
const whopClient = new Whop({
  apiKey: WHOP_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const headers = await import('next/headers').then(m => m.headers());
    const userId = headers.get('x-user-id');
    const companyId = headers.get('x-company-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { priceCents, numPlays, capperUsername } = body;

    if (!priceCents || !numPlays || !capperUsername) {
      return NextResponse.json(
        { error: 'Missing required fields: priceCents, numPlays, capperUsername' },
        { status: 400 }
      );
    }

    // Validate price is positive
    if (typeof priceCents !== 'number' || priceCents <= 0) {
      return NextResponse.json(
        { error: 'Price must be a positive number' },
        { status: 400 }
      );
    }

    // Validate numPlays is positive integer
    if (typeof numPlays !== 'number' || numPlays <= 0 || !Number.isInteger(numPlays)) {
      return NextResponse.json(
        { error: 'Number of plays must be a positive integer' },
        { status: 400 }
      );
    }

    // Validate reasonable limits
    if (numPlays > 1000) {
      return NextResponse.json(
        { error: 'Number of plays cannot exceed 1000' },
        { status: 400 }
      );
    }

    const capper = await User.findOne({ whopUserId: userId, companyId: companyId });
    if (!capper) {
      return NextResponse.json({ error: 'Capper user not found' }, { status: 404 });
    }

    if (capper.role !== 'companyOwner' && capper.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only company owners can create follow offers' },
        { status: 403 }
      );
    }

    const capperIdString = String(capper._id);

    if (!WHOP_API_KEY || !EDGEIQ_COMPANY_ID || !WHOP_FOLLOW_PRODUCT_ID) {
      return NextResponse.json(
        { error: 'Whop configuration missing on server' },
        { status: 500 }
      );
    }

    // Create (or recreate) a Whop plan for this capper's follow offer.
    // Then create a checkout configuration with metadata so webhooks can
    // identify which project/capper this payment is for.
    const plan = await whopClient.plans.create({
      company_id: EDGEIQ_COMPANY_ID,
      product_id: WHOP_FOLLOW_PRODUCT_ID,
      initial_price: priceCents,
      plan_type: 'one_time',
      currency: 'usd',
      title: `Follow ${capperUsername} - ${numPlays} plays`,
    });

    const planId = plan.id;

    // Attach metadata via a checkout configuration so that every resulting
    // payment includes project/capper information.
    const checkoutConfig = await whopClient.checkoutConfigurations.create({
      plan_id: planId,
      affiliate_code: capperUsername,
      metadata: {
        followPurchase: true,
        project: 'Trade',
        capperUserId: capperIdString,
        capperCompanyId: capper.companyId || companyId,
        numPlays,
      },
    });

    const purchaseUrl = checkoutConfig.purchase_url;

    if (!planId || !purchaseUrl) {
      return NextResponse.json(
        { error: 'Invalid checkout response from Whop' },
        { status: 500 }
      );
    }

    // Remove all existing query parameters, remove trailing slash, and add only ?a=username
    const url = new URL(purchaseUrl);
    url.search = ''; // Clear all existing query parameters (including session)
    
    // Remove trailing slash from pathname
    url.pathname = url.pathname.replace(/\/$/, '');
    
    // Add affiliate code
    url.searchParams.set('a', capperUsername);
    const finalCheckoutUrl = url.toString();

    // Always update with new plan_id - each capper gets unique plan_id
    capper.followOfferEnabled = true;
    capper.followOfferPriceCents = priceCents;
    capper.followOfferNumPlays = numPlays;
    capper.followOfferPlanId = planId; // Unique plan_id per capper
    capper.followOfferCheckoutUrl = finalCheckoutUrl;
    await capper.save();

    return NextResponse.json({
      success: true,
      planId: planId,
      checkoutUrl: finalCheckoutUrl,
    });
  } catch (error) {
    console.error('Error creating follow checkout:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

