terraform {
  required_version = ">= 1.9, < 2.0"
  backend "azurerm" {}
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.50" }
  }
}
provider "azurerm" {
  features {}
  storage_use_azuread = true
}
data "azurerm_client_config" "current" {}
locals {
  tags = { service = "sentiment-analysis", environment = var.environment, managed_by = "terraform" }
}
resource "azurerm_resource_group" "service" {
  name     = "${var.name}-${var.environment}"
  location = var.location
  tags     = local.tags
}
resource "azurerm_user_assigned_identity" "runtime" {
  name                = "${var.name}-${var.environment}"
  resource_group_name = azurerm_resource_group.service.name
  location            = var.location
  tags                = local.tags
}
