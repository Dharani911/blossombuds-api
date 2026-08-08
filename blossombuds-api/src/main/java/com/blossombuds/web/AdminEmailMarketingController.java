package com.blossombuds.web;

import com.blossombuds.dto.EmailMarketingDtos;
import com.blossombuds.service.EmailCampaignService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Admin APIs for managing marketing email campaigns and recipients. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/email-marketing")
@PreAuthorize("hasRole('ADMIN')")
public class AdminEmailMarketingController {

    private final EmailCampaignService emailCampaignService;

    /** Lists email campaigns ordered by latest first. */
    @GetMapping("/campaigns")
    public List<EmailMarketingDtos.CampaignResponse> listCampaigns() {
        return emailCampaignService.listCampaigns()
                .stream()
                .map(emailCampaignService::toCampaignResponse)
                .toList();
    }

    /** Creates a new email campaign and resolves recipients from the fixed audience rule
     *  (customers with no phone on file, not unsubscribed). */
    @PostMapping("/campaigns")
    public EmailMarketingDtos.CampaignResponse createCampaign(
            @RequestBody EmailCampaignService.CreateCampaignRequest request
    ) {
        return emailCampaignService.toCampaignResponse(
                emailCampaignService.createCampaign(request)
        );
    }

    /** Sends all pending recipients for a campaign. */
    @PostMapping("/campaigns/{campaignId}/send")
    public EmailMarketingDtos.CampaignResponse sendCampaign(@PathVariable Long campaignId) {
        return emailCampaignService.toCampaignResponse(
                emailCampaignService.sendCampaign(campaignId)
        );
    }

    /** Lists recipients for a campaign. */
    @GetMapping("/campaigns/{campaignId}/recipients")
    public List<EmailMarketingDtos.RecipientResponse> listRecipients(@PathVariable Long campaignId) {
        return emailCampaignService.listRecipients(campaignId)
                .stream()
                .map(emailCampaignService::toRecipientResponse)
                .toList();
    }
}
